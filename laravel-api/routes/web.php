<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return ['message' => 'Lab BTP API', 'version' => '1.0'];
});
