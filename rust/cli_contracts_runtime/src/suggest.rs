//! The "(Did you mean ...?)" of an unknown option or command, by the rules of
//! commander 14 (lib/suggestSimilar.js). Lengths and characters are
//! JavaScript's UTF-16 code units.

use std::cmp::Ordering;

const MAX_DISTANCE: usize = 3;

fn edit_distance(a: &[u16], b: &[u16]) -> usize {
    if a.len().abs_diff(b.len()) > MAX_DISTANCE {
        return a.len().max(b.len());
    }
    let mut d = vec![vec![0usize; b.len() + 1]; a.len() + 1];
    for (i, row) in d.iter_mut().enumerate() {
        row[0] = i;
    }
    for (j, cell) in d[0].iter_mut().enumerate() {
        *cell = j;
    }
    for j in 1..=b.len() {
        for i in 1..=a.len() {
            let cost = usize::from(a[i - 1] != b[j - 1]);
            d[i][j] = (d[i - 1][j] + 1)
                .min(d[i][j - 1] + 1)
                .min(d[i - 1][j - 1] + cost);
            if i > 1 && j > 1 && a[i - 1] == b[j - 2] && a[i - 2] == b[j - 1] {
                d[i][j] = d[i][j].min(d[i - 2][j - 2] + 1);
            }
        }
    }
    d[a.len()][b.len()]
}

pub(crate) fn suggest_similar(word: &str, candidates: &[&str]) -> String {
    if candidates.is_empty() {
        return String::new();
    }
    let mut unique: Vec<&str> = Vec::new();
    for c in candidates {
        if !unique.contains(c) {
            unique.push(c);
        }
    }
    let searching_options = word.starts_with("--");
    let (word, unique): (&str, Vec<&str>) = if searching_options {
        (
            &word[2..],
            unique.iter().map(|c| c.get(2..).unwrap_or("")).collect(),
        )
    } else {
        (word, unique)
    };
    let w: Vec<u16> = word.encode_utf16().collect();
    let mut similar: Vec<&str> = Vec::new();
    let mut best_distance = MAX_DISTANCE;
    const MIN_SIMILARITY: f64 = 0.4;
    for candidate in unique {
        let c: Vec<u16> = candidate.encode_utf16().collect();
        if c.len() <= 1 {
            continue;
        }
        let distance = edit_distance(&w, &c);
        let length = w.len().max(c.len());
        let similarity = (length as f64 - distance as f64) / length as f64;
        if similarity > MIN_SIMILARITY {
            match distance.cmp(&best_distance) {
                Ordering::Less => {
                    best_distance = distance;
                    similar = vec![candidate];
                }
                Ordering::Equal => similar.push(candidate),
                Ordering::Greater => {}
            }
        }
    }
    similar.sort_by(|a, b| locale_compare(a, b));
    let similar: Vec<String> = similar
        .into_iter()
        .map(|c| {
            if searching_options {
                format!("--{c}")
            } else {
                c.to_string()
            }
        })
        .collect();
    match similar.len() {
        0 => String::new(),
        1 => format!("\n(Did you mean {}?)", similar[0]),
        _ => format!("\n(Did you mean one of {}?)", similar.join(", ")),
    }
}

/// The order of a character in the root collation `String.prototype.localeCompare`
/// uses, for the characters of option and command names: punctuation (`_`
/// before `-`), then digits, then letters alphabetically without regard to
/// case; any other character by its code point after them.
fn collation_key(c: char) -> (u32, bool) {
    match c {
        '_' => (1, false),
        '-' => (2, false),
        '0'..='9' => (200 + (c as u32 - '0' as u32), false),
        'a'..='z' => (300 + (c as u32 - 'a' as u32), false),
        'A'..='Z' => (300 + (c as u32 - 'A' as u32), true),
        c if (c as u32) < 0x80 => (3 + c as u32, false),
        c => (1000 + c as u32, false),
    }
}

/// Compares as `String.prototype.localeCompare` does for the characters
/// `collation_key` orders: first without regard to case, then a lowercase
/// letter before its uppercase.
fn locale_compare(a: &str, b: &str) -> Ordering {
    let ka: Vec<(u32, bool)> = a.chars().map(collation_key).collect();
    let kb: Vec<(u32, bool)> = b.chars().map(collation_key).collect();
    let primary = ka.iter().map(|k| k.0).cmp(kb.iter().map(|k| k.0));
    if primary != Ordering::Equal {
        return primary;
    }
    ka.iter().map(|k| k.1).cmp(kb.iter().map(|k| k.1))
}
