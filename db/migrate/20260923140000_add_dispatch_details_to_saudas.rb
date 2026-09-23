class AddDispatchDetailsToSaudas < ActiveRecord::Migration[7.1]
  def change
    # Who carried the goods and under which bilty (the transporter's consignment
    # note), so the register can be matched against the lorry's paperwork.
    add_column :saudas, :transporter_name, :string
    add_column :saudas, :bilty_no, :string
    add_column :saudas, :bilty_date, :date
  end
end
