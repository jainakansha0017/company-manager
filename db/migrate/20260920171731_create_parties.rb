class CreateParties < ActiveRecord::Migration[7.1]
  def change
    create_table :parties do |t|
      # Single-table inheritance: "Buyer" or "Seller".
      t.string :type, null: false
      t.references :company, null: false, foreign_key: true

      t.string :name, null: false
      t.text :address
      t.string :email
      t.string :phone_no
      t.string :pan
      t.boolean :gst_registered, null: false, default: false
      t.string :gst_no
      t.string :trade_license_no
      t.string :food_license_no

      t.timestamps
    end

    add_index :parties, %i[company_id type name]

    # PAN/GST are unique per company *and* per role, so one legal entity can be
    # a buyer for two companies, or both a buyer and a seller for one company.
    add_index :parties, %i[company_id type pan],
              unique: true, name: "index_parties_on_company_type_pan"
    add_index :parties, %i[company_id type gst_no],
              unique: true, name: "index_parties_on_company_type_gst_no"
  end
end
