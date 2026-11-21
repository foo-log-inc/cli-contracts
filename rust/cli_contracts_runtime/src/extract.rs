//! The built-in extract command. Its output is computed when the program is
//! generated (cli-contracts `src/generators/runtime-spec.ts`, ExtractSpec);
//! what depends on the invocation is filled in here: the time, and which
//! commands the given IDs select.

use std::time::{SystemTime, UNIX_EPOCH};

use crate::json::{Object, Value};
use crate::tree::Arg;

/// Stands where the time of the invocation goes in the output.
pub const EXTRACTED_AT: &str = "\u{0}cli-contracts:extractedAt\u{0}";
/// `EXTRACTED_AT` as it appears inside a JSON string.
const EXTRACTED_AT_JSON: &str = "\\u0000cli-contracts:extractedAt\\u0000";

/// A command set of the embedded contract.
#[derive(Debug, Clone, PartialEq)]
pub struct ExtractSet {
    pub id: &'static str,
    pub key: &'static str,
    pub before: Vec<&'static str>,
    pub after: Vec<&'static str>,
    /// Each command's ID and its JSON at its depth.
    pub commands: Vec<(&'static str, &'static str)>,
}

/// The output of the built-in extract command.
#[derive(Debug, Clone, PartialEq)]
pub struct ExtractSpec {
    pub yaml_with_meta: &'static str,
    pub yaml_without_meta: &'static str,
    pub json_with_meta: &'static str,
    pub json_without_meta: &'static str,
    pub filter_head: &'static str,
    pub filter_tail: &'static str,
    pub sets: Vec<ExtractSet>,
}

/// The time as JavaScript's `Date.prototype.toISOString` writes it.
fn iso_now() -> String {
    let elapsed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let millis = elapsed.subsec_millis();
    let secs = elapsed.as_secs() as i64;
    let days = secs.div_euclid(86_400);
    let rem = secs.rem_euclid(86_400);
    // Civil date from days since 1970-01-01 (Howard Hinnant's algorithm).
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}.{millis:03}Z",
        rem / 3600,
        rem % 3600 / 60,
        rem % 60
    )
}

fn truthy(v: Option<&Value>) -> bool {
    match v {
        None | Some(Value::Null) => false,
        Some(Value::Bool(b)) => *b,
        Some(Value::String(s)) => !s.is_empty(),
        Some(_) => true,
    }
}

/// Runs the built-in extract command: the exit code, stdout and stderr.
pub(crate) fn run_extract(
    spec: &ExtractSpec,
    args: &[Arg],
    opts: &Object,
) -> (i32, String, String) {
    let commands = args.first().map(|a| a.values()).unwrap_or_default();
    let all = truthy(opts.get("all"));
    if commands.is_empty() && !all {
        return (
            2,
            String::new(),
            "{\"code\":\"INVALID_ARGS\",\"message\":\"Specify command IDs or use --all\"}\n"
                .to_string(),
        );
    }
    let format = match opts.get("format") {
        Some(Value::String(s)) if !s.is_empty() => s.clone(),
        _ => "yaml".to_string(),
    };
    let ids: Vec<String> = if all { Vec::new() } else { commands };
    let include_meta = truthy(opts.get("includeMeta"));
    let now = iso_now();
    if ids.is_empty() {
        let out = if format == "json" {
            let text = if include_meta {
                spec.json_with_meta
            } else {
                spec.json_without_meta
            };
            text.replace(EXTRACTED_AT_JSON, &now)
        } else {
            let text = if include_meta {
                spec.yaml_with_meta
            } else {
                spec.yaml_without_meta
            };
            text.replace(EXTRACTED_AT, &now)
        };
        return (0, out, String::new());
    }

    let selected = |set_id: &str, cmd_id: &str| {
        ids.iter().any(|id| {
            id == cmd_id
                || *id == format!("{set_id}.{cmd_id}")
                || cmd_id.starts_with(&format!("{id}."))
        })
    };
    let mut sets: Vec<String> = Vec::new();
    for set in &spec.sets {
        let matched: Vec<&str> = set
            .commands
            .iter()
            .filter(|(id, _)| selected(set.id, id))
            .map(|(_, text)| *text)
            .collect();
        if matched.is_empty() {
            continue;
        }
        let mut entries: Vec<String> = set.before.iter().map(|s| s.to_string()).collect();
        entries.push(format!(
            "      \"commands\": {{\n{}\n      }}",
            matched.join(",\n")
        ));
        entries.extend(set.after.iter().map(|s| s.to_string()));
        sets.push(format!("{}{{\n{}\n    }}", set.key, entries.join(",\n")));
    }
    let command_sets = if sets.is_empty() {
        "{}".to_string()
    } else {
        format!("{{\n{}\n  }}", sets.join(",\n"))
    };
    (
        0,
        format!("{}{}{}", spec.filter_head, command_sets, spec.filter_tail),
        String::new(),
    )
}
