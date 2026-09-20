class Seller < Party
  # The shipping marks this seller trades under.
  has_many :marks, dependent: :destroy
  has_many :saudas, dependent: :restrict_with_error
end
