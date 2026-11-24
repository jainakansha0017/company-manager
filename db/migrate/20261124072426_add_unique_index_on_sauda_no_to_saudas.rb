class AddUniqueIndexOnSaudaNoToSaudas < ActiveRecord::Migration[7.1]
  # A standalone reference to the table, not the app's Sauda model, so this
  # migration still runs the same way after the model itself has moved on.
  class MigrationSauda < ActiveRecord::Base
    self.table_name = "saudas"
  end

  def up
    dedupe_sauda_no
    add_index :saudas, "lower(sauda_no)", unique: true, where: "sauda_no <> ''",
                                           name: "index_saudas_on_lower_sauda_no_uniq"
  end

  def down
    remove_index :saudas, name: "index_saudas_on_lower_sauda_no_uniq"
  end

  private

  # Data entered before sauda no. was unique may already repeat a number. The
  # oldest sauda keeps it as typed; anything later sharing it is suffixed
  # `-dup2`, `-dup3`, … so nothing is lost or silently overwritten, and the
  # unique index below has nothing left to collide on.
  def dedupe_sauda_no
    duplicated = MigrationSauda.where.not(sauda_no: [nil, ""])
                                .group("lower(sauda_no)")
                                .having("count(*) > 1")
                                .pluck(Arel.sql("lower(sauda_no)"))

    duplicated.each do |lower_no|
      MigrationSauda.where("lower(sauda_no) = ?", lower_no).order(:id)
                     .each_with_index do |sauda, index|
        next if index.zero?

        sauda.update_column(:sauda_no, "#{sauda.sauda_no}-dup#{index + 1}")
      end
    end
  end
end
