class CreateMarks < ActiveRecord::Migration[7.1]
  def change
    create_table :marks do |t|
      # A mark belongs to the seller it is shipped under. Sellers are STI on
      # `parties`, so the foreign key points there.
      t.references :seller, null: false, foreign_key: { to_table: :parties }
      t.string :name, null: false

      t.timestamps
    end

    add_index :marks, %i[seller_id name], unique: true
  end
end
