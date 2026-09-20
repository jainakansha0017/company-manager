class CreateCompanies < ActiveRecord::Migration[7.1]
  def change
    create_table :companies do |t|
      t.string :name, null: false
      t.text :address
      t.string :email
      t.string :phone_no
      t.string :pan
      t.boolean :gst_registered, null: false, default: false
      t.string :gst_no
      t.string :trade_license_no
      t.string :food_license_no
      t.string :financial_year

      t.timestamps
    end

    add_index :companies, :name
    add_index :companies, :pan, unique: true
    add_index :companies, :gst_no, unique: true
  end
end
