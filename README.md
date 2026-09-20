# Company Manager

A sauda register for a trading house. You register a company, keep its buyers
and sellers along with their bank details, and record each sauda: what a seller
sold to a buyer, under which marks, in which lots and grades, and how many kilos
that comes to.

## Stack

- Ruby 3.1.0, Rails 7.1
- MySQL 8
- React 19, bundled by esbuild through jsbundling-rails
- RSpec and FactoryBot

Rails serves JSON under `/api/v1` and one HTML page; everything else is React
talking to that API.

## Getting started

```sh
bundle install
yarn install
cp .env.example .env    # then fill in your MySQL credentials
bin/rails db:prepare
bin/dev                 # Rails on :3000 plus esbuild in watch mode
```

`config/database.yml` reads its credentials from the environment, so nothing
machine specific is committed.

## Tests

```sh
bundle exec rspec
```

## How it fits together

A company owns its buyers and sellers. Those two share one `parties` table
through single table inheritance, and a bank account hangs off either a company
or a party polymorphically.

A sauda belongs to one company, one of its sellers and one of its buyers. Each
sauda has many marks; a mark carries its lot numbers and a row per grade, and
each grade records how many bags there are and what one bag weighs. `total_kg`
is derived from those rows rather than typed in, so the stored figure cannot
drift from what it is made of.

Sellers and buyers cannot be deleted while a sauda still refers to them.
Deleting a company takes its whole register with it.
