FactoryBot.define do
  factory :bank_account do
    association :accountable, factory: :company
    bank_name { "HDFC Bank" }
    branch { "Park Street" }
    sequence(:account_number) { |n| format("5010%08d", n) }
    ifsc_code { "HDFC0001234" }
    account_type { "Current" }
  end
end
