class AddBrokerageBasisToParties < ActiveRecord::Migration[7.1]
  def change
    # Which figure a seller's brokerage is worked out on: the amount the goods
    # came to, or the taxable value left after the discount. Buyers share the
    # table but have no brokerage, so this stays null for them.
    add_column :parties, :brokerage_basis, :string

    # The broker's cut, worked out from whichever figure the seller is dealt
    # with on. Stored alongside the rest of the bill rather than recomputed on
    # read, so an old sauda keeps the brokerage it was actually struck at.
    add_column :saudas, :brokerage_amt, :decimal, precision: 12, scale: 2
  end
end
