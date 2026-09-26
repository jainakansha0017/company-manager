class MakeSaudaCompanyOptional < ActiveRecord::Migration[7.1]
  # A sauda is no longer required to belong to a company: the financial year
  # is worked out from the sauda date, not the company's own, and there is not
  # yet any link from a seller to a company that would make one implicit. The
  # column stays — old saudas keep the company they were recorded under, and
  # a future "map this seller to a company" feature can still write to it.
  def change
    change_column_null :saudas, :company_id, true
  end
end
