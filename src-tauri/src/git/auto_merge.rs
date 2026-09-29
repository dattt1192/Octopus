//! Conservative, line-based three-way resolution. Output references existing
//! source lines; it never invents text or chooses between overlapping edits.
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Pick {
    Current(usize),
    Incoming(usize),
}

struct Edit {
    start: usize,
    end: usize,
    lines: Vec<Pick>,
}

type Alignment = (Vec<Edit>, Vec<Option<usize>>);

fn edits(base: &[Vec<u8>], side: &[Vec<u8>], incoming: bool) -> Option<Alignment> {
    // Repeated lines and reordered anchors can have multiple valid alignments.
    // Leave those blocks to the user rather than guessing which occurrence moved.
    fn unique(lines: &[Vec<u8>]) -> Option<HashMap<&[u8], usize>> {
        let mut positions = HashMap::new();
        for (index, line) in lines.iter().enumerate() {
            if positions.insert(line.as_slice(), index).is_some() {
                return None;
            }
        }
        Some(positions)
    }
    unique(base)?;
    let positions = unique(side)?;
    let mut alignment = vec![None; base.len()];
    let mut changes = Vec::new();
    let (mut from_base, mut from_side) = (0, 0);
    for (at_base, at_side) in base
        .iter()
        .enumerate()
        .filter_map(|(i, line)| positions.get(line.as_slice()).map(|j| (i, *j)))
        .chain(std::iter::once((base.len(), side.len())))
    {
        if at_side < from_side {
            return None;
        }
        if at_base > from_base || at_side > from_side {
            changes.push(Edit {
                start: from_base,
                end: at_base,
                lines: (from_side..at_side)
                    .map(|i| {
                        if incoming {
                            Pick::Incoming(i)
                        } else {
                            Pick::Current(i)
                        }
                    })
                    .collect(),
            });
        }
        if at_base < base.len() {
            alignment[at_base] = Some(at_side);
        }
        from_base = at_base + 1;
        from_side = at_side + 1;
    }
    Some((changes, alignment))
}

fn overlap(a: &Edit, b: &Edit) -> bool {
    if a.start == a.end {
        return b.start <= a.start && a.start <= b.end;
    }
    if b.start == b.end {
        return a.start <= b.start && b.start <= a.end;
    }
    a.start < b.end && b.start < a.end
}

pub fn resolve(
    base: Option<&[Vec<u8>]>,
    current: &[Vec<u8>],
    incoming: &[Vec<u8>],
) -> Option<Vec<Pick>> {
    if current == incoming {
        return Some((0..current.len()).map(Pick::Current).collect());
    }
    let base = base?;
    if current == base {
        return Some((0..incoming.len()).map(Pick::Incoming).collect());
    }
    if incoming == base {
        return Some((0..current.len()).map(Pick::Current).collect());
    }
    let (mut changes, alignment) = edits(base, current, false)?;
    let (other, _) = edits(base, incoming, true)?;
    if changes.len().saturating_mul(other.len()) > 1_000_000 {
        return None;
    }
    let bytes = |p: &Pick| match *p {
        Pick::Current(i) => &current[i],
        Pick::Incoming(i) => &incoming[i],
    };
    for next in other {
        let overlaps: Vec<_> = changes.iter().filter(|old| overlap(old, &next)).collect();
        if !overlaps.is_empty() {
            if overlaps.len() == 1
                && overlaps[0].start == next.start
                && overlaps[0].end == next.end
                && overlaps[0]
                    .lines
                    .iter()
                    .map(&bytes)
                    .eq(next.lines.iter().map(&bytes))
            {
                continue;
            }
            return None;
        }
        changes.push(next);
    }
    changes.sort_by_key(|edit| edit.start);
    let mut output = Vec::new();
    let mut cursor = 0;
    for edit in changes {
        for index in &alignment[cursor..edit.start] {
            output.push(Pick::Current((*index)?));
        }
        output.extend(edit.lines);
        cursor = edit.end;
    }
    for index in &alignment[cursor..] {
        output.push(Pick::Current((*index)?));
    }
    Some(output)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn lines(text: &str) -> Vec<Vec<u8>> {
        text.split_inclusive('\n')
            .map(|line| line.as_bytes().to_vec())
            .collect()
    }
    fn merged(base: Option<&str>, current: &str, incoming: &str) -> Option<String> {
        let base = base.map(lines);
        let current = lines(current);
        let incoming = lines(incoming);
        resolve(base.as_deref(), &current, &incoming).map(|picks| {
            String::from_utf8(
                picks
                    .iter()
                    .flat_map(|pick| match *pick {
                        Pick::Current(i) => current[i].clone(),
                        Pick::Incoming(i) => incoming[i].clone(),
                    })
                    .collect(),
            )
            .unwrap()
        })
    }
    #[test]
    fn identical_sides_need_no_base() {
        assert_eq!(merged(None, "same\n", "same\n"), Some("same\n".into()));
    }
    #[test]
    fn missing_base_is_not_an_empty_base() {
        assert_eq!(merged(None, "", "added\n"), None);
        assert_eq!(merged(Some(""), "", "added\n"), Some("added\n".into()));
    }
    #[test]
    fn one_unchanged_side_takes_the_changed_side_including_deletion() {
        assert_eq!(merged(Some("a\n"), "a\n", ""), Some("".into()));
        assert_eq!(merged(Some("a\n"), "b\n", "a\n"), Some("b\n".into()));
    }
    #[test]
    fn adjacent_changes_merge_without_duplicate_context() {
        assert_eq!(
            merged(Some("a\nb\nc\n"), "A\nb\nc\n", "a\nB\nc\n"),
            Some("A\nB\nc\n".into())
        );
    }
    #[test]
    fn disjoint_insertions_and_deletions_merge() {
        assert_eq!(
            merged(Some("a\nb\nc\n"), "a\nx\nb\nc\n", "a\nb\n"),
            Some("a\nx\nb\n".into())
        );
    }
    #[test]
    fn overlapping_changes_and_competing_insertions_stay_unresolved() {
        assert_eq!(merged(Some("a\n"), "ours\n", "theirs\n"), None);
        assert_eq!(merged(Some("a\n"), "x\na\n", "y\na\n"), None);
    }
    #[test]
    fn identical_edits_are_deduplicated() {
        assert_eq!(
            merged(Some("a\nb\nc\n"), "x\na\nB\nc\n", "x\na\nb\nC\n"),
            Some("x\na\nB\nC\n".into())
        );
    }
    #[test]
    fn ambiguous_repeats_and_reordering_are_skipped() {
        assert_eq!(merged(Some("a\na\nb\n"), "a\nA\nb\n", "a\na\nB\n"), None);
        assert_eq!(merged(Some("a\nb\nc\n"), "b\na\nc\n", "a\nb\nC\n"), None);
    }
    #[test]
    fn preserves_exact_line_endings() {
        assert_eq!(
            merged(Some("a\r\nb\r\nc"), "A\r\nb\r\nc", "a\r\nB\r\nc"),
            Some("A\r\nB\r\nc".into())
        );
    }
}
