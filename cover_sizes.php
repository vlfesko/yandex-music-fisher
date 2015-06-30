<?php

set_time_limit(600);

define('MAX_SIZE', 1600);
define('INC', 5);

$coverUrl = 'http://avatars.yandex.net/get-music-content/78e6a9c4.a.960649-1/';
$outputFilename = 'cover_sizes_' . date('d.m.y') . '.txt';

for ($i = 10; $i < MAX_SIZE; $i += INC) {
    $size = $i . 'x' . $i;
    if (@file_get_contents($coverUrl . $size)) {
        if (!file_put_contents($outputFilename, $size . PHP_EOL, FILE_APPEND)) {
            echo 'Не удалось записать размер ' . $size . '<br>';
        }
    }
}

echo 'Всё';
