require "rails_helper"

RSpec.describe Sauda do
  it "is valid with a company, a seller, a buyer and a mark" do
    expect(build(:sauda)).to be_valid
  end

  # A sauda is not tied to a company: there is no link yet from a seller to
  # one, so nothing can be inferred, and nothing needs it typed in either.
  it "does not require a company" do
    sauda = build(:sauda, company: nil)

    expect(sauda).to be_valid
  end

  it "requires a seller" do
    sauda = build(:sauda, seller: nil)

    expect(sauda).not_to be_valid
    expect(sauda.errors[:seller]).to be_present
  end

  it "requires a buyer" do
    sauda = build(:sauda, buyer: nil)

    expect(sauda).not_to be_valid
    expect(sauda.errors[:buyer]).to be_present
  end

  it "requires a date" do
    sauda = build(:sauda, sauda_date: nil)

    expect(sauda).not_to be_valid
    expect(sauda.errors[:sauda_date]).to be_present
  end

  it "only accepts sellers, not buyers" do
    expect { create(:sauda, seller: create(:buyer)) }
      .to raise_error(ActiveRecord::AssociationTypeMismatch)
  end

  it "needs at least one mark" do
    sauda = build(:sauda, mark_count: 0)

    expect(sauda).not_to be_valid
    expect(sauda.errors[:sauda_marks]).to include("must include at least one mark")
  end

  it "rejects a discount of more than the whole amount" do
    sauda = build(:sauda, discount_percent: 101)

    expect(sauda).not_to be_valid
    expect(sauda.errors[:discount_percent]).to be_present
  end

  describe "the bill" do
    # A sauda worth exactly `amount`: one grade of a single one-kilo bag priced
    # at the amount itself, so what is under test is the bill's arithmetic and
    # not the kilos'.
    def sauda_worth(amount, **attributes)
      sauda = build(:sauda, mark_count: 0, **attributes)
      mark = build(:sauda_mark, sauda: sauda, grade_count: 0,
                                mark: build(:mark, seller: sauda.seller))
      mark.sauda_grades << build(:sauda_grade, sauda_mark: mark, bags: 1, weight: 1, rate: amount)
      sauda.sauda_marks << mark
      sauda.tap(&:save!)
    end

    it "prices the grades at their rates and adds them up into the amount" do
      sauda = build(:sauda, mark_count: 0)
      mark = build(:sauda_mark, sauda: sauda, grade_count: 0,
                                mark: build(:mark, seller: sauda.seller))
      mark.sauda_grades << build(:sauda_grade, sauda_mark: mark, bags: 10, weight: 25.5, rate: 2)
      mark.sauda_grades << build(:sauda_grade, sauda_mark: mark, bags: 4, weight: 50, rate: 3)
      sauda.sauda_marks << mark

      sauda.validate

      expect(sauda.amount).to eq(1_110) # 255 kg @ 2 + 200 kg @ 3
    end

    it "counts only the grades that carry a rate" do
      sauda = build(:sauda, mark_count: 0)
      mark = build(:sauda_mark, sauda: sauda, grade_count: 0,
                                mark: build(:mark, seller: sauda.seller))
      mark.sauda_grades << build(:sauda_grade, sauda_mark: mark, bags: 10, weight: 25.5, rate: 2)
      mark.sauda_grades << build(:sauda_grade, sauda_mark: mark, bags: 4, weight: 50, rate: nil)
      sauda.sauda_marks << mark

      sauda.validate

      expect(sauda.amount).to eq(510)
    end

    it "takes the discount off the amount and puts GST on what is left" do
      sauda = sauda_worth(100_000, discount_percent: 2.5)

      expect(sauda.amount).to eq(100_000)
      expect(sauda.disc_amt).to eq(2_500)
      expect(sauda.taxable_value).to eq(97_500)
      expect(sauda.gst_amt).to eq(4_875)
      expect(sauda.total_tax_bill_amt).to eq(102_375)
    end

    it "bills the full amount when there is no discount" do
      sauda = sauda_worth(1_000)

      expect(sauda.disc_amt).to eq(0)
      expect(sauda.taxable_value).to eq(1_000)
      expect(sauda.total_tax_bill_amt).to eq(1_050)
    end

    it "rounds each step to paise, so the stored figures add up" do
      sauda = sauda_worth(999.99, discount_percent: 3.33)

      expect(sauda.disc_amt).to eq(33.30)
      expect(sauda.taxable_value).to eq(966.69)
      expect(sauda.gst_amt).to eq(48.33)
      expect(sauda.total_tax_bill_amt).to eq(1_015.02)
      expect(sauda.taxable_value + sauda.gst_amt).to eq(sauda.total_tax_bill_amt)
    end

    it "recalculates when a rate changes" do
      sauda = sauda_worth(1_000)

      sauda.sauda_marks.first.sauda_grades.first.update!(rate: 2_000)
      sauda.save!

      expect(sauda.amount).to eq(2_000)
      expect(sauda.total_tax_bill_amt).to eq(2_100)
    end

    it "leaves the bill empty until the grades are rated" do
      sauda = create(:sauda)

      expect(sauda.amount).to be_nil
      expect(sauda.total_tax_bill_amt).to be_nil
    end

    # Clearing the rates has to clear the bill too, or the figures from the last
    # time it was priced would stay behind and outlive the kilos they came from.
    it "clears the bill when the rates are taken off" do
      sauda = sauda_worth(1_000)

      sauda.sauda_marks.first.sauda_grades.first.update!(rate: nil)
      sauda.save!

      expect(sauda.amount).to be_nil
      expect(sauda.disc_amt).to be_nil
      expect(sauda.taxable_value).to be_nil
      expect(sauda.gst_amt).to be_nil
      expect(sauda.total_tax_bill_amt).to be_nil
      expect(sauda.brokerage_amt).to be_nil
    end

    describe "brokerage" do
      # The same sauda pays the broker differently depending on what the seller
      # agreed with them: 100,000 on the goods, 97,500 left after the discount.
      def sauda_for(basis)
        seller = create(:seller, brokerage_basis: basis)
        sauda_worth(100_000, seller: seller, discount_percent: 2.5)
      end

      it "takes one per cent of the amount" do
        expect(sauda_for("amount").brokerage_amt).to eq(1_000)
      end

      it "takes one per cent of the taxable value" do
        expect(sauda_for("taxable_value").brokerage_amt).to eq(975)
      end

      it "is nothing at all for a seller with no arrangement recorded" do
        expect(sauda_for(nil).brokerage_amt).to be_nil
      end
    end
  end

  describe "#total_kg" do
    it "adds up bags x weight per bag across every grade of every mark" do
      sauda = build(:sauda, mark_count: 0)
      mark = build(:sauda_mark, sauda: sauda, grade_count: 0)
      mark.sauda_grades << build(:sauda_grade, sauda_mark: mark, bags: 10, weight: 25.5)
      mark.sauda_grades << build(:sauda_grade, sauda_mark: mark, bags: 4, weight: 50)
      sauda.sauda_marks << mark

      sauda.validate

      expect(sauda.total_kg).to eq(455)
    end

    it "ignores marks that are on their way out" do
      sauda = create(:sauda)
      sauda.sauda_marks.first.mark_for_destruction

      sauda.validate

      expect(sauda.total_kg).to eq(0)
    end
  end

  # India's financial year runs 1 April to 31 March.
  describe "#financial_year" do
    it "puts April onwards in the year that is starting" do
      expect(build(:sauda, sauda_date: Date.new(2025, 4, 1)).financial_year).to eq("2025-2026")
      expect(build(:sauda, sauda_date: Date.new(2025, 12, 31)).financial_year).to eq("2025-2026")
    end

    it "puts January to March in the year that is ending" do
      expect(build(:sauda, sauda_date: Date.new(2026, 3, 31)).financial_year).to eq("2025-2026")
      expect(build(:sauda, sauda_date: Date.new(2026, 4, 1)).financial_year).to eq("2026-2027")
    end

    it "writes both years out in full, so a century rolls over plainly" do
      expect(build(:sauda, sauda_date: Date.new(2099, 6, 1)).financial_year).to eq("2099-2100")
    end
  end

  describe ".in_financial_year" do
    it "takes the saudas dated between one April and the next March" do
      first_day = create(:sauda, sauda_date: Date.new(2025, 4, 1))
      last_day = create(:sauda, sauda_date: Date.new(2026, 3, 31))
      create(:sauda, sauda_date: Date.new(2025, 3, 31))
      create(:sauda, sauda_date: Date.new(2026, 4, 1))

      expect(described_class.in_financial_year("2025-2026"))
        .to contain_exactly(first_day, last_day)
    end

    # Only the four digits it starts with are read, so a year typed the short
    # way still finds the same saudas.
    it "reads the year written the short way the same" do
      sauda = create(:sauda, sauda_date: Date.new(2025, 6, 1))

      expect(described_class.in_financial_year("2025-26")).to eq([sauda])
    end

    # What "All years" asks for.
    it "narrows nothing when given no year" do
      create(:sauda)

      expect(described_class.in_financial_year("").count).to eq(1)
      expect(described_class.in_financial_year(nil).count).to eq(1)
    end
  end

  describe ".ordered" do
    it "lists the newest sauda date first" do
      older = create(:sauda, sauda_date: 2.days.ago.to_date)
      newer = create(:sauda, sauda_date: Date.current)

      expect(described_class.ordered).to eq([newer, older])
    end
  end
end
