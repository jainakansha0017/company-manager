class Buyer < Party
  has_many :saudas, dependent: :restrict_with_error
end
