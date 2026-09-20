class CreateBankAccounts < ActiveRecord::Migration[7.1]
  def change
    create_table :bank_accounts do |t|
      t.references :company, null: false, foreign_key: true
      t.string :bank_name, null: false
      t.string :branch
      t.string :account_number, null: false
      t.string :ifsc_code
      t.string :account_type

      t.timestamps
    end
  end
end
