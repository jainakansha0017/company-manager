class AddTradeDetailsToSaudas < ActiveRecord::Migration[7.1]
  def change
    change_table :saudas, bulk: true do |t|
      t.string :tax_invoice_no
      t.date :sauda_date, null: false
      t.string :destination
      # Money as decimal, never float.
      t.decimal :total_tax_bill_amt, precision: 12, scale: 2
      t.decimal :gst_amt, precision: 12, scale: 2
      t.decimal :disc_amt, precision: 12, scale: 2
      t.decimal :taxable_value, precision: 12, scale: 2
      # Derived from the grade rows (sum of bags x weight); stored so the
      # register can list it without loading every line.
      t.decimal :total_kg, precision: 12, scale: 3, null: false, default: 0
    end

    add_reference :saudas, :buyer, foreign_key: { to_table: :parties }
    add_index :saudas, %i[company_id sauda_date]
  end
end
