FactoryBot.define do
  factory :sauda do
    transient do
      # A sauda is only valid with at least one mark, so build one by default.
      # Pass `mark_count: 0` to test that rule.
      mark_count { 1 }
    end

    company
    # Default the seller and buyer into the same company, which the model requires.
    seller { association :seller, company: company }
    buyer { association :buyer, company: company }
    sequence(:sauda_no) { |n| "S-#{format('%04d', n)}" }
    sauda_date { Date.current }
    bill_date { Date.current }
    sequence(:tax_invoice_no) { |n| "TI-#{format('%04d', n)}" }
    destination { "Kolkata" }

    after(:build) do |sauda, evaluator|
      evaluator.mark_count.times do
        sauda.sauda_marks << build(:sauda_mark, sauda: sauda, mark: build(:mark, seller: sauda.seller))
      end
    end
  end

  factory :mark do
    seller
    sequence(:name) { |n| "Mark #{n}" }
  end

  factory :sauda_mark do
    transient do
      grade_count { 1 }
    end

    sauda
    # Keep the mark with the sauda's own seller, which the model requires.
    mark { association :mark, seller: sauda.seller }
    lot_nos { "L-1; L-2" }

    after(:build) do |sauda_mark, evaluator|
      evaluator.grade_count.times do
        sauda_mark.sauda_grades << build(:sauda_grade, sauda_mark: sauda_mark)
      end
    end
  end

  factory :sauda_grade do
    sauda_mark
    sequence(:grade) { |n| "PD#{n}" }
    bags { 10 }
    weight { "25.5" }
  end
end
