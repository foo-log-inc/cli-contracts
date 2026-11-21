# cli-contracts PHP runtime

The runtime of the PHP programs and command wrappers [cli-contracts](https://github.com/foo-log-inc/cli-contracts) generates from a CLI contract (`templates: builtin:php`). A generated program holds its command tree and handler interface; this package (namespace `CliContracts\Runtime`) parses an invocation over the tree by the same rules as the TypeScript program generated from the same contract (commander), and writes the same help, errors, `--introspect` policy and `extract` output.

PHP 8.1 or later, with `ext-mbstring`. The package is not published to Packagist: add it from a checkout of this repository with a Composer path repository.

```json
{
    "repositories": [{ "type": "path", "url": "../cli-contracts/php" }],
    "require": { "cli-contracts/runtime": "*" }
}
```

## Usage

Generate the classes (`cli-contracts.config.yaml`):

```yaml
generators:
  php:
    enabled: true
    output: ./src/Cli
    templates: builtin:php
    options:
      namespace: App\Cli
```

Implement the handlers and run the program:

```php
<?php

use App\Cli\CommandHandlers;
use App\Cli\Program;
use CliContracts\Runtime as Rt;

final class Handlers implements CommandHandlers
{
    // One method per command of the contract; it returns the exit code (null for 0).
    public function usersImport(string $file, array $options, array $parentOpts): ?int
    {
        if (($options['dryRun'] ?? false) === true) {
            echo "dry run: {$file}\n";
        }
        return 0;
    }
}

Program::create(new Handlers(), '1.0.0', static function (Rt\UsageError $err, Rt\Command $command): int {
    // Optional: ends an invocation the program rejects with what the contract declares.
    fwrite(STDERR, '{"code":"INVALID_ARGS","message":' . Rt\Json::quote($err->message) . "}\n");
    return 2;
})->main();
```

The options a handler receives are the options given or defaulted, keyed as the program keys them (`dry-run` → `dryRun`); `$parentOpts` holds those of the command and its ancestors. A command that takes `--adapter` may return the prompt it built, or `[exitCode, prompt]`; the program writes the prompt with `--show-prompt`.

`Program::run($argv, $stdout, $stderr)` runs an invocation without exiting and returns its exit code.

## License

MIT
