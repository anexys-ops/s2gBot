# API Laravel — PHP-FPM 8.4+ (production, aligné sur composer.lock / Symfony 8)
FROM php:8.4-fpm-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    git unzip openssl \
    libicu-dev libzip-dev libpng-dev libjpeg62-turbo-dev libfreetype6-dev \
    libonig-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" pdo_mysql zip intl opcache gd \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY docker/php-fpm-zz-env.conf /usr/local/etc/php-fpm.d/zz-env.conf
COPY docker/uploads.ini /usr/local/etc/php/conf.d/uploads.ini

WORKDIR /var/www/html

COPY . .

RUN composer install --no-dev --no-interaction --prefer-dist \
    && mkdir -p storage/framework/{sessions,views,cache/data} storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod +x docker-entrypoint.sh

ENTRYPOINT ["/var/www/html/docker-entrypoint.sh"]
CMD ["php-fpm"]
