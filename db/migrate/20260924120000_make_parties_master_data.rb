class MakePartiesMasterData < ActiveRecord::Migration[7.1]
  # One way only. Dropping the column throws away which company each buyer and
  # seller was entered under, and nothing left in the schema can work it out
  # again, so there is no honest `down` to write.
  def up
    # Every one of these led with company_id, so none of them survives it.
    remove_index :parties, name: "index_parties_on_company_id_and_type_and_name"
    remove_index :parties, name: "index_parties_on_company_type_pan"
    remove_index :parties, name: "index_parties_on_company_type_gst_no"

    remove_reference :parties, :company, foreign_key: true

    # The same firm can still appear once as a buyer and once as a seller, but
    # only once in each, whoever is trading with them.
    add_index :parties, %i[type name]
    add_index :parties, %i[type pan], unique: true
    add_index :parties, %i[type gst_no], unique: true
  end
end
