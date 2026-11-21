//! The command wrappers' side: running a CLI with the arguments a wrapper
//! built, and writing a number as an argument the way the TypeScript
//! wrapper's `String(value)` does.

use std::process::Command;

/// The outcome of running a CLI.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExecResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

/// Runs an executable with arguments. A CLI that cannot be started, or is
/// ended by a signal, has exit code 1.
pub fn exec(executable: &str, args: &[String]) -> ExecResult {
    match Command::new(executable).args(args).output() {
        Ok(output) => ExecResult {
            exit_code: output.status.code().unwrap_or(1),
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        },
        Err(_) => ExecResult {
            exit_code: 1,
            stdout: String::new(),
            stderr: String::new(),
        },
    }
}

/// Writes a number as JavaScript's `String(n)` does (Number::toString: the
/// shortest digits that read back as the number, in fixed notation from 1e-7
/// up to 1e21 and exponential notation outside).
pub fn format_number(f: f64) -> String {
    if f.is_nan() {
        return "NaN".to_string();
    }
    if f.is_infinite() {
        return if f > 0.0 { "Infinity" } else { "-Infinity" }.to_string();
    }
    if f == 0.0 {
        return "0".to_string();
    }
    let sign = if f < 0.0 { "-" } else { "" };
    // d.ddde±x: the shortest digits and the exponent.
    let e = format!("{:e}", f.abs());
    let (mantissa, exp) = e.split_once('e').expect("exponential notation");
    let digits: String = mantissa.chars().filter(|c| *c != '.').collect();
    let exp: i32 = exp.parse().expect("exponent");
    let k = digits.len() as i32;
    let n = exp + 1;
    let out = if k <= n && n <= 21 {
        format!("{digits}{}", "0".repeat((n - k) as usize))
    } else if 0 < n && n <= 21 {
        format!("{}.{}", &digits[..n as usize], &digits[n as usize..])
    } else if -6 < n && n <= 0 {
        format!("0.{}{digits}", "0".repeat((-n) as usize))
    } else {
        let m = if k > 1 {
            format!("{}.{}", &digits[..1], &digits[1..])
        } else {
            digits.clone()
        };
        format!("{m}e{}{}", if n - 1 < 0 { "-" } else { "+" }, (n - 1).abs())
    };
    format!("{sign}{out}")
}
