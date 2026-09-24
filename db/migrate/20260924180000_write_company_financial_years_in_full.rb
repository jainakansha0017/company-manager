class WriteCompanyFinancialYearsInFull < ActiveRecord::Migration[7.1]
  SHORT = /\A(\d{4})\s*-\s*(\d{2})\z/
  LONG = /\A(\d{4})-\d{2}(\d{2})\z/

  # A company's own financial year was stored the short way, "2025-26", while the
  # sauda register writes both years out. This brings the stored ones into line.
  def up
    rewrite(SHORT) do |start, finish|
      # The century comes from the year that is ending, so "2099-00" becomes
      # 2099-2100 rather than 2099-1900.
      "#{start}-#{format('%d%02d', start.to_i.next / 100, finish.to_i)}"
    end
  end

  def down
    rewrite(LONG) { |start, finish| "#{start}-#{finish}" }
  end

  private

  def rewrite(pattern)
    select_rows("SELECT id, financial_year FROM companies WHERE financial_year IS NOT NULL")
      .each do |id, year|
        match = pattern.match(year)
        next if match.nil?

        execute(<<~SQL.squish)
          UPDATE companies SET financial_year = #{quote(yield(*match.captures))}
          WHERE id = #{Integer(id)}
        SQL
      end
  end
end
