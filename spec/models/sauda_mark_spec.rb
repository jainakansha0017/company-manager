require "rails_helper"

RSpec.describe SaudaMark do
  it "is valid with a mark and one grade" do
    expect(build(:sauda_mark)).to be_valid
  end

  it "requires a mark" do
    sauda_mark = build(:sauda_mark, mark: nil)

    expect(sauda_mark).not_to be_valid
    expect(sauda_mark.errors[:mark]).to be_present
  end

  it "needs at least one grade" do
    sauda_mark = build(:sauda_mark, grade_count: 0)

    expect(sauda_mark).not_to be_valid
    expect(sauda_mark.errors[:sauda_grades]).to include("must include at least one grade")
  end

  # The form only offers the seller's own marks, so anything else is a mistake.
  it "rejects a mark belonging to another seller" do
    sauda_mark = build(:sauda_mark, mark: create(:mark))

    expect(sauda_mark).not_to be_valid
    expect(sauda_mark.errors[:mark]).to include("does not belong to this seller")
  end

  describe "lot numbers" do
    it "reads a semicolon separated list" do
      sauda_mark = build(:sauda_mark, lot_nos: "L-1; L-2 ;; L-3")

      expect(sauda_mark.lot_no_list).to eq(%w[L-1 L-2 L-3])
    end

    it "stores them in one tidy form" do
      sauda_mark = create(:sauda_mark, lot_nos: "L-1 ;;L-2; ")

      expect(sauda_mark.lot_nos).to eq("L-1; L-2")
    end

    it "is happy without any" do
      sauda_mark = create(:sauda_mark, lot_nos: "  ")

      expect(sauda_mark.lot_nos).to be_nil
    end
  end

  describe "#total_bags" do
    it "adds up the bags over its grades" do
      sauda_mark = build(:sauda_mark, grade_count: 0)
      sauda_mark.sauda_grades << build(:sauda_grade, sauda_mark: sauda_mark, bags: 10)
      sauda_mark.sauda_grades << build(:sauda_grade, sauda_mark: sauda_mark, bags: 4)

      expect(sauda_mark.total_bags).to eq(14)
    end

    it "ignores grades on their way out" do
      sauda_mark = create(:sauda_mark, grade_count: 2)
      sauda_mark.sauda_grades.first.mark_for_destruction

      expect(sauda_mark.total_bags).to eq(10)
    end
  end

  describe "#total_kg" do
    it "adds up bags x weight per bag over its grades" do
      sauda_mark = build(:sauda_mark, grade_count: 0)
      sauda_mark.sauda_grades << build(:sauda_grade, sauda_mark: sauda_mark, bags: 10, weight: 25.5)
      sauda_mark.sauda_grades << build(:sauda_grade, sauda_mark: sauda_mark, bags: 2, weight: 10)

      expect(sauda_mark.total_kg).to eq(275)
    end
  end

  describe "#amount" do
    it "adds up what its priced grades come to" do
      sauda_mark = build(:sauda_mark, grade_count: 0)
      sauda_mark.sauda_grades << build(:sauda_grade, sauda_mark: sauda_mark, bags: 10, weight: 25.5, rate: 2)
      sauda_mark.sauda_grades << build(:sauda_grade, sauda_mark: sauda_mark, bags: 2, weight: 10, rate: 1.5)

      expect(sauda_mark.amount).to eq(540)
    end

    it "is nothing at all when none of its grades carry a rate" do
      expect(build(:sauda_mark).amount).to be_nil
    end
  end
end
