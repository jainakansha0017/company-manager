class AddUniqueIndexOnSaudaNoToSaudas < ActiveRecord::Migration[7.1]
  def change
    # Partial: blank sauda_no values are allowed (and allowed to repeat) by the
    # model, so they are left out of the constraint; only a real, filled-in
    # sauda no. has to be unique, case-insensitively, across the whole table.
    add_index :saudas, "lower(sauda_no)", unique: true, where: "sauda_no <> ''",
                                           name: "index_saudas_on_lower_sauda_no_uniq"
  end
end
