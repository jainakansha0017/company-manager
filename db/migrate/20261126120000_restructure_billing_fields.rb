class RestructureBillingFields < ActiveRecord::Migration[7.1]
  class MigrationSauda < ActiveRecord::Base
    self.table_name = "saudas"
  end

  class MigrationSaudaBill < ActiveRecord::Base
    self.table_name = "sauda_bills"
  end

  def up
    add_column :saudas, :bilty_no, :string
    add_column :saudas, :bilty_date, :date

    add_column :sauda_bills, :discount_percent, :decimal, precision: 5, scale: 2
    add_column :sauda_bills, :total_kg, :decimal, precision: 12, scale: 3
    add_column :sauda_bills, :amount, :decimal, precision: 12, scale: 2
    add_column :sauda_bills, :disc_amt, :decimal, precision: 12, scale: 2
    add_column :sauda_bills, :taxable_value, :decimal, precision: 12, scale: 2
    add_column :sauda_bills, :gst_amt, :decimal, precision: 12, scale: 2
    add_column :sauda_bills, :total_tax_bill_amt, :decimal, precision: 12, scale: 2
    add_column :sauda_bills, :brokerage_amt, :decimal, precision: 12, scale: 2

    backfill_bilty_onto_saudas
    backfill_bill_figures

    remove_column :sauda_bills, :bilty_no, :string
    remove_column :sauda_bills, :bilty_date, :date
    remove_column :saudas, :discount_percent, :decimal
  end

  def down
    add_column :saudas, :discount_percent, :decimal, precision: 5, scale: 2
    add_column :sauda_bills, :bilty_no, :string
    add_column :sauda_bills, :bilty_date, :date

    restore_bilty_onto_bills
    restore_discount_onto_saudas

    remove_column :sauda_bills, :discount_percent, :decimal
    remove_column :sauda_bills, :total_kg, :decimal
    remove_column :sauda_bills, :amount, :decimal
    remove_column :sauda_bills, :disc_amt, :decimal
    remove_column :sauda_bills, :taxable_value, :decimal
    remove_column :sauda_bills, :gst_amt, :decimal
    remove_column :sauda_bills, :total_tax_bill_amt, :decimal
    remove_column :sauda_bills, :brokerage_amt, :decimal

    remove_column :saudas, :bilty_no, :string
    remove_column :saudas, :bilty_date, :date
  end

  private

  # Bilty moves from per-bill back to the sauda: with the feature this new, a
  # sauda had at most the one bill the earlier migration backfilled, so its
  # bilty is simply that bill's.
  def backfill_bilty_onto_saudas
    MigrationSaudaBill.order(:id).group_by(&:sauda_id).each do |sauda_id, bills|
      bill = bills.first
      MigrationSauda.where(id: sauda_id).update_all(bilty_no: bill.bilty_no, bilty_date: bill.bilty_date)
    end
  end

  # The discount and the figures it fed into move from the sauda to its
  # bill(s). Every sauda this migration finds still has exactly the one bill
  # ("All" was never unchecked yet), so that bill simply inherits the whole
  # sauda's existing discount and already-correct totals rather than having
  # them recomputed from the marks underneath — recomputing is what every
  # future save does from here on.
  def backfill_bill_figures
    MigrationSauda.find_each do |sauda|
      MigrationSaudaBill.where(sauda_id: sauda.id).update_all(
        discount_percent: sauda.discount_percent,
        total_kg: sauda.total_kg,
        amount: sauda.amount,
        disc_amt: sauda.disc_amt,
        taxable_value: sauda.taxable_value,
        gst_amt: sauda.gst_amt,
        total_tax_bill_amt: sauda.total_tax_bill_amt,
        brokerage_amt: sauda.brokerage_amt,
      )
    end
  end

  def restore_bilty_onto_bills
    MigrationSauda.find_each do |sauda|
      MigrationSaudaBill.where(sauda_id: sauda.id).update_all(
        bilty_no: sauda.bilty_no,
        bilty_date: sauda.bilty_date,
      )
    end
  end

  def restore_discount_onto_saudas
    MigrationSaudaBill.order(:id).group_by(&:sauda_id).each do |sauda_id, bills|
      bill = bills.first
      MigrationSauda.where(id: sauda_id).update_all(discount_percent: bill.discount_percent)
    end
  end
end
