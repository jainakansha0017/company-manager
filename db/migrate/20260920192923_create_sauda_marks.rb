class CreateSaudaMarks < ActiveRecord::Migration[7.1]
  def change
    # One sauda covers many marks, and each mark carries its own lot numbers
    # and one row per grade.
    create_table :sauda_marks do |t|
      t.references :sauda, null: false, foreign_key: true
      t.references :mark, null: false, foreign_key: true
      # Entered semicolon-separated, stored the same way.
      t.string :lot_nos

      t.timestamps
    end

    create_table :sauda_grades do |t|
      t.references :sauda_mark, null: false, foreign_key: true
      t.string :grade, null: false
      t.integer :bags, null: false
      # Weight of one bag, in kg.
      t.decimal :weight, precision: 10, scale: 3, null: false

      t.timestamps
    end
  end
end
