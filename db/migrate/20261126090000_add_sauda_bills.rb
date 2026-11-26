class AddSaudaBills < ActiveRecord::Migration[7.1]
  # Standalone references to the tables, not the app's own models, so this
  # migration still runs the same way after those models have moved on.
  class MigrationSauda < ActiveRecord::Base
    self.table_name = "saudas"
  end

  class MigrationSaudaBill < ActiveRecord::Base
    self.table_name = "sauda_bills"
  end

  def up
    create_table :sauda_bills do |t|
      t.references :sauda, null: false, foreign_key: true
      t.string :bill_no
      t.date :bill_date
      t.string :bilty_no
      t.date :bilty_date
      # Which lot numbers this bill covers, in the same "; "-joined free-text
      # form as a mark's own lot_nos. Blank means "every lot" — the one bill a
      # sauda has until it is split into more than one.
      t.string :lot_nos

      t.timestamps
    end

    backfill_bills
    remove_column :saudas, :tax_invoice_no, :string
    remove_column :saudas, :bill_date, :date
    remove_column :saudas, :bilty_no, :string
    remove_column :saudas, :bilty_date, :date
  end

  def down
    add_column :saudas, :tax_invoice_no, :string
    add_column :saudas, :bill_date, :date
    add_column :saudas, :bilty_no, :string
    add_column :saudas, :bilty_date, :date

    restore_bills
    drop_table :sauda_bills
  end

  private

  # One bill per existing sauda, carrying what used to be its own flat
  # columns. lot_nos is left blank, which is what "this bill covers every lot"
  # means both before and after this migration.
  def backfill_bills
    MigrationSauda.find_each do |sauda|
      MigrationSaudaBill.create!(
        sauda_id: sauda.id,
        bill_no: sauda.tax_invoice_no,
        bill_date: sauda.bill_date,
        bilty_no: sauda.bilty_no,
        bilty_date: sauda.bilty_date,
      )
    end
  end

  # The reverse of the backfill: a sauda with more than one bill by the time
  # this is rolled back has no flat columns to put them in, so only the first
  # is kept, same as if the others had never existed.
  def restore_bills
    MigrationSaudaBill.order(:id).group_by(&:sauda_id).each do |sauda_id, bills|
      bill = bills.first
      MigrationSauda.where(id: sauda_id).update_all(
        tax_invoice_no: bill.bill_no,
        bill_date: bill.bill_date,
        bilty_no: bill.bilty_no,
        bilty_date: bill.bilty_date,
      )
    end
  end
end
