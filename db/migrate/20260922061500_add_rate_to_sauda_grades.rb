class AddRateToSaudaGrades < ActiveRecord::Migration[7.1]
  def change
    # What a kilo of this grade sells for. Multiplied by the kilos the grade
    # comes to, it gives the grade's share of the bill; those shares added up
    # are the sauda's amount, which is why amount is no longer typed in.
    add_column :sauda_grades, :rate, :decimal, precision: 10, scale: 2
  end
end
