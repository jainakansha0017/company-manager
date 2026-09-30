class AddCreditDueToSaudas < ActiveRecord::Migration[7.1]
  def change
    add_column :saudas, :credit_due, :decimal, precision: 12, scale: 2
  end
end
