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
end
