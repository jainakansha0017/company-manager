require "rails_helper"

RSpec.describe Sauda do
  it "is valid with a company, one of its sellers and buyers, and a mark" do
    expect(build(:sauda)).to be_valid
  end

  it "requires a company" do
    sauda = build(:sauda, company: nil)

    expect(sauda).not_to be_valid
    expect(sauda.errors[:company]).to be_present
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

  # A sauda is struck between a company and its own seller; pairing it with
  # another company's seller would leak data across companies.
  it "rejects a seller belonging to a different company" do
    sauda = build(:sauda, seller: create(:seller))

    expect(sauda).not_to be_valid
    expect(sauda.errors[:seller]).to include("does not belong to this company")
  end

  it "rejects a buyer belonging to a different company" do
    sauda = build(:sauda, buyer: create(:buyer))

    expect(sauda).not_to be_valid
    expect(sauda.errors[:buyer]).to include("does not belong to this company")
  end

  it "only accepts sellers, not buyers" do
    company = create(:company)
    buyer = create(:buyer, company: company)

    expect { create(:sauda, company: company, seller: buyer) }
      .to raise_error(ActiveRecord::AssociationTypeMismatch)
  end

  it "needs at least one mark" do
    sauda = build(:sauda, mark_count: 0)

    expect(sauda).not_to be_valid
    expect(sauda.errors[:sauda_marks]).to include("must include at least one mark")
  end

  it "rejects negative amounts" do
    sauda = build(:sauda, gst_amt: -1)

    expect(sauda).not_to be_valid
    expect(sauda.errors[:gst_amt]).to be_present
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

  describe ".ordered" do
    it "lists the newest sauda date first" do
      company = create(:company)
      seller = create(:seller, company: company)
      older = create(:sauda, company: company, seller: seller, sauda_date: 2.days.ago.to_date)
      newer = create(:sauda, company: company, seller: seller, sauda_date: Date.current)

      expect(described_class.ordered).to eq([newer, older])
    end
  end
end
