FactoryBot.define do
  factory :company do
    transient do
      bank_account_count { 1 }
    end

    sequence(:name) { |n| "Acme Foods #{n}" }
    address { "12 Park Street, Kolkata 700016" }
    sequence(:email) { |n| "owner#{n}@acmefoods.test" }
    phone_no { "+91 9830012345" }
    sequence(:pan) { |n| "ABCDE#{format('%04d', n)}F" }
    gst_registered { false }
    trade_license_no { "TL-2025-0091" }
    food_license_no { "FSSAI-11223344556677" }
    financial_year { "2025-26" }

    after(:build) do |company, evaluator|
      evaluator.bank_account_count.times do
        company.bank_accounts << build(:bank_account, accountable: company)
      end
    end

    trait :gst_registered do
      gst_registered { true }
      sequence(:gst_no) { |n| "19ABCDE#{format('%04d', n)}F1Z5" }
    end
  end
end
