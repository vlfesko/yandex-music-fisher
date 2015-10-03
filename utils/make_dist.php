<?php

define('SRC_FOLDER', '../src');
define('DIST_FOLDER', '../yandex-music-fisher');
define('README_DRAFT_FILENAME', 'readme_draft.txt');
define('README_FILENAME', '../readme.md');
define('MANIFEST_FILENAME', SRC_FOLDER . '/manifest.json');

if (php_sapi_name() !== 'cli') {
    exit('CLI mode only');
}

if (empty($argv[1])) {
    $argv[1] = 'current';
}
$allowedVersions = ['major', 'minor', 'patch', 'current'];
if (!in_array($argv[1], $allowedVersions, true)) {
    $message = 'usage: php make_dist.php [<version>]' . PHP_EOL;
    $message .= 'Version should be: major, minor, patch or current' . PHP_EOL;
    exit($message);
}

echo 'Processing...' . PHP_EOL;

$manifestStr = file_get_contents(MANIFEST_FILENAME);
if (!$manifestStr) {
    exit("Can't read manifest file" . PHP_EOL);
}

$manifest = json_decode($manifestStr, true);
if (!$manifest) {
    exit("Can't decode JSON from manifest file" . PHP_EOL);
}

$currentVersion = explode('.', $manifest['version']);
$newVersion = $currentVersion;
switch ($argv[1]) {
    case 'major':
        $newVersion[0]++;
        $newVersion[1] = 0;
        $newVersion[2] = 0;
        break;
    case 'minor':
        $newVersion[1]++;
        $newVersion[2] = 0;
        break;
    case 'patch':
        $newVersion[2]++;
        break;
}
$newVersionStr = implode('.', $newVersion);

$manifestStr = str_replace('"' . $manifest['version'] . '"', '"' . $newVersionStr . '"', $manifestStr);
if (!file_put_contents(MANIFEST_FILENAME, $manifestStr)) {
    exit("Can't write to manifest file" . PHP_EOL);
}

$readmeStr = file_get_contents(README_DRAFT_FILENAME);
if (!$readmeStr) {
    exit("Can't read draft readme file" . PHP_EOL);
}

$readmeStr = str_replace('$version$', $newVersionStr, $readmeStr);
if (!file_put_contents(README_FILENAME, $readmeStr)) {
    exit("Can't write to readme file" . PHP_EOL);
}

if (!rename(SRC_FOLDER, DIST_FOLDER)) {
    exit("Can't rename src folder");
}

$command = 'winrar a -afzip -m5 -r -t yandex-music-fisher_' . $newVersionStr . '.zip ' . DIST_FOLDER;
$output = [];
$exitCode = 0;
exec($command, $output, $exitCode);
if ($exitCode > 0) {
    exit('WinRAR error: ' . $exitCode);
}

if (!rename(DIST_FOLDER, SRC_FOLDER)) {
    exit("Can't rename dist folder");
}

echo 'All done. Version is ' . $newVersionStr . PHP_EOL;
