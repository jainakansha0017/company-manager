# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.1].define(version: 2026_09_22_051500) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "bank_accounts", force: :cascade do |t|
    t.string "bank_name", null: false
    t.string "branch"
    t.string "account_number", null: false
    t.string "ifsc_code"
    t.string "account_type"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "accountable_type", null: false
    t.bigint "accountable_id", null: false
    t.index ["accountable_type", "accountable_id"], name: "index_bank_accounts_on_accountable"
  end

  create_table "companies", force: :cascade do |t|
    t.string "name", null: false
    t.text "address"
    t.string "email"
    t.string "phone_no"
    t.string "pan"
    t.boolean "gst_registered", default: false, null: false
    t.string "gst_no"
    t.string "trade_license_no"
    t.string "food_license_no"
    t.string "financial_year"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["gst_no"], name: "index_companies_on_gst_no", unique: true
    t.index ["name"], name: "index_companies_on_name"
    t.index ["pan"], name: "index_companies_on_pan", unique: true
  end

  create_table "marks", force: :cascade do |t|
    t.bigint "seller_id", null: false
    t.string "name", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["seller_id", "name"], name: "index_marks_on_seller_id_and_name", unique: true
    t.index ["seller_id"], name: "index_marks_on_seller_id"
  end

  create_table "parties", force: :cascade do |t|
    t.string "type", null: false
    t.bigint "company_id", null: false
    t.string "name", null: false
    t.text "address"
    t.string "email"
    t.string "phone_no"
    t.string "pan"
    t.boolean "gst_registered", default: false, null: false
    t.string "gst_no"
    t.string "trade_license_no"
    t.string "food_license_no"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["company_id", "type", "gst_no"], name: "index_parties_on_company_type_gst_no", unique: true
    t.index ["company_id", "type", "name"], name: "index_parties_on_company_id_and_type_and_name"
    t.index ["company_id", "type", "pan"], name: "index_parties_on_company_type_pan", unique: true
    t.index ["company_id"], name: "index_parties_on_company_id"
  end

  create_table "sauda_grades", force: :cascade do |t|
    t.bigint "sauda_mark_id", null: false
    t.string "grade", null: false
    t.integer "bags", null: false
    t.decimal "weight", precision: 10, scale: 3, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["sauda_mark_id"], name: "index_sauda_grades_on_sauda_mark_id"
  end

  create_table "sauda_marks", force: :cascade do |t|
    t.bigint "sauda_id", null: false
    t.bigint "mark_id", null: false
    t.string "lot_nos"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["mark_id"], name: "index_sauda_marks_on_mark_id"
    t.index ["sauda_id"], name: "index_sauda_marks_on_sauda_id"
  end

  create_table "saudas", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.bigint "seller_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "tax_invoice_no"
    t.date "sauda_date", null: false
    t.string "destination"
    t.decimal "total_tax_bill_amt", precision: 12, scale: 2
    t.decimal "gst_amt", precision: 12, scale: 2
    t.decimal "disc_amt", precision: 12, scale: 2
    t.decimal "taxable_value", precision: 12, scale: 2
    t.decimal "total_kg", precision: 12, scale: 3, default: "0.0", null: false
    t.bigint "buyer_id"
    t.string "sauda_no"
    t.date "bill_date"
    t.decimal "amount", precision: 12, scale: 2
    t.decimal "discount_percent", precision: 5, scale: 2
    t.index ["buyer_id"], name: "index_saudas_on_buyer_id"
    t.index ["company_id", "sauda_date"], name: "index_saudas_on_company_id_and_sauda_date"
    t.index ["company_id", "sauda_no"], name: "index_saudas_on_company_id_and_sauda_no"
    t.index ["company_id", "seller_id", "created_at"], name: "index_saudas_on_company_id_and_seller_id_and_created_at"
    t.index ["company_id"], name: "index_saudas_on_company_id"
    t.index ["seller_id"], name: "index_saudas_on_seller_id"
  end

  add_foreign_key "marks", "parties", column: "seller_id"
  add_foreign_key "parties", "companies"
  add_foreign_key "sauda_grades", "sauda_marks"
  add_foreign_key "sauda_marks", "marks"
  add_foreign_key "sauda_marks", "saudas"
  add_foreign_key "saudas", "companies"
  add_foreign_key "saudas", "parties", column: "buyer_id"
  add_foreign_key "saudas", "parties", column: "seller_id"
end
