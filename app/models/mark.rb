# A shipping mark a seller trades under. Sellers usually have several, and the
# sauda form picks one per line.
class Mark < ApplicationRecord
  belongs_to :seller

  before_validation :normalise_name

  validates :name, presence: true, length: { maximum: 255 },
                   uniqueness: { scope: :seller_id, case_sensitive: false }

  scope :ordered, -> { order(name: :asc) }

  private

  def normalise_name
    self.name = name.strip.squeeze(" ") if name.present?
  end
end
