require "rails_helper"

RSpec.describe SaudaGrade do
  it "is valid with a grade, bags and a weight" do
    expect(build(:sauda_grade)).to be_valid
  end

  it "requires a grade" do
    grade = build(:sauda_grade, grade: " ")

    expect(grade).not_to be_valid
    expect(grade.errors[:grade]).to include("can't be blank")
  end

  it "tidies stray whitespace in the grade" do
    grade = create(:sauda_grade, grade: "  BOP  Special ")

    expect(grade.grade).to eq("BOP Special")
  end

  it "needs at least one bag" do
    expect(build(:sauda_grade, bags: 0)).not_to be_valid
    expect(build(:sauda_grade, bags: 2.5)).not_to be_valid
  end

  it "needs a positive weight" do
    expect(build(:sauda_grade, weight: 0)).not_to be_valid
  end

  # Weight is what one bag weighs, so the kilos are the product of the two.
  it "multiplies bags by the weight of one bag" do
    expect(build(:sauda_grade, bags: 12, weight: 25.5).total_kg).to eq(306)
  end

  it "treats a half-filled row as nothing" do
    expect(build(:sauda_grade, bags: nil).total_kg).to eq(0)
  end

  it "rejects a negative rate" do
    grade = build(:sauda_grade, rate: -1)

    expect(grade).not_to be_valid
    expect(grade.errors[:rate]).to be_present
  end

  describe "#amount" do
    it "prices the kilos at the rate per kilo" do
      expect(build(:sauda_grade, bags: 12, weight: 25.5, rate: 2.5).amount).to eq(765)
    end

    it "rounds to paise" do
      # 3.015 kg at 2.55 comes to 7.68825.
      expect(build(:sauda_grade, bags: 3, weight: "1.005", rate: "2.55").amount).to eq(7.69)
    end

    it "is nothing at all until a rate is set" do
      expect(build(:sauda_grade, rate: nil).amount).to be_nil
    end
  end
end
