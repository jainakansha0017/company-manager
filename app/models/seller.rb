class Seller < Party
  # Which of the sauda's figures this seller's brokerage is worked out on.
  BROKERAGE_BASES = %w[amount taxable_value].freeze

  # The shipping marks this seller trades under.
  has_many :marks, dependent: :destroy
  has_many :saudas, dependent: :restrict_with_error

  # The form sends "" for "not set", which should read as no basis at all.
  before_validation { self.brokerage_basis = brokerage_basis.presence }

  validates :brokerage_basis, inclusion: { in: BROKERAGE_BASES }, allow_nil: true
end
