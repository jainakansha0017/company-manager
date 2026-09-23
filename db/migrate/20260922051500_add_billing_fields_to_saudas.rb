class AddBillingFieldsToSaudas < ActiveRecord::Migration[7.1]
  def change
    add_column :saudas, :sauda_no, :string
    add_column :saudas, :bill_date, :date

    # What the buyer is billed before any deduction, and the discount as a
    # percentage of it. Everything else in the amounts section is worked out
    # from these two, so they are the only figures anyone types.
    add_column :saudas, :amount, :decimal, precision: 12, scale: 2
    add_column :saudas, :discount_percent, :decimal, precision: 5, scale: 2

    add_index :saudas, %i[company_id sauda_no]
  end
end
