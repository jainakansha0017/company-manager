class CreateSaudas < ActiveRecord::Migration[7.1]
  def change
    create_table :saudas do |t|
      t.references :company, null: false, foreign_key: true
      # Sellers are STI on `parties`, so the foreign key points there.
      t.references :seller, null: false, foreign_key: { to_table: :parties }

      t.timestamps
    end

    # The register is always read as "this seller's saudas, newest first".
    add_index :saudas, %i[company_id seller_id created_at]
  end
end
