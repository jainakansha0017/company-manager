class MakeBankAccountsPolymorphic < ActiveRecord::Migration[7.1]
  # Bank accounts used to hang off companies only. Buyers and sellers carry the
  # same details, so the owner becomes polymorphic.
  def up
    add_column :bank_accounts, :accountable_type, :string
    add_column :bank_accounts, :accountable_id, :bigint

    execute <<~SQL.squish
      UPDATE bank_accounts
      SET accountable_type = 'Company', accountable_id = company_id
    SQL

    change_column_null :bank_accounts, :accountable_type, false
    change_column_null :bank_accounts, :accountable_id, false
    add_index :bank_accounts, %i[accountable_type accountable_id],
              name: "index_bank_accounts_on_accountable"

    remove_foreign_key :bank_accounts, :companies
    remove_column :bank_accounts, :company_id
  end

  def down
    add_column :bank_accounts, :company_id, :bigint

    execute <<~SQL.squish
      UPDATE bank_accounts
      SET company_id = accountable_id
      WHERE accountable_type = 'Company'
    SQL

    # Accounts belonging to buyers/sellers cannot be represented by company_id.
    execute "DELETE FROM bank_accounts WHERE accountable_type <> 'Company'"

    change_column_null :bank_accounts, :company_id, false
    add_index :bank_accounts, :company_id
    add_foreign_key :bank_accounts, :companies

    remove_index :bank_accounts, name: "index_bank_accounts_on_accountable"
    remove_column :bank_accounts, :accountable_type
    remove_column :bank_accounts, :accountable_id
  end
end
