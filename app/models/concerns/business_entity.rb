# Fields and rules shared by every business entity we store: the operating
# Company, and the Buyers/Sellers it trades with. Uniqueness is deliberately
# left out — it is scoped globally for companies but per-company for parties.
module BusinessEntity
  extend ActiveSupport::Concern

  PAN_FORMAT = /\A[A-Z]{5}[0-9]{4}[A-Z]\z/
  GST_FORMAT = /\A[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}\z/
  PHONE_FORMAT = /\A\+?[0-9][0-9\s-]{7,19}\z/

  # Blank strings would collide with each other under the unique indexes, so
  # optional identifiers are stored as NULL instead.
  OPTIONAL_IDENTIFIERS = %i[pan gst_no trade_license_no food_license_no].freeze

  included do
    has_many :bank_accounts, as: :accountable, dependent: :destroy
    accepts_nested_attributes_for :bank_accounts, allow_destroy: true

    before_validation :normalise_attributes

    validates :name, presence: true, length: { maximum: 255 }
    validates :address, presence: true
    # Both are optional: plenty of the parties in this trade are dealt with over
    # the phone or in person, and a record should not be unsaveable for want of
    # a detail nobody has. Still checked when one is given, so a typo is caught.
    validates :email, format: { with: URI::MailTo::EMAIL_REGEXP, message: "is not a valid email address" },
                      allow_blank: true
    validates :phone_no, format: { with: PHONE_FORMAT, message: "is not a valid phone number" },
                         allow_blank: true
    validates :gst_registered, inclusion: { in: [true, false] }
    validates :pan, format: { with: PAN_FORMAT, message: "must be 10 characters, e.g. ABCDE1234F" },
                    allow_nil: true
    validates :gst_no, presence: true,
                       format: { with: GST_FORMAT, message: "must be 15 characters, e.g. 19ABCDE1234F1Z5" },
                       if: :gst_registered?
    validate :must_keep_one_bank_account
  end

  private

  # Records marked for destruction are still in the association until save, so
  # `presence` alone would let an update delete every account.
  def must_keep_one_bank_account
    return if bank_accounts.reject(&:marked_for_destruction?).any?

    errors.add(:bank_accounts, "must include at least one account")
  end

  def normalise_attributes
    self.email = email.strip.downcase if email.present?
    self.pan = pan.strip.upcase if pan.present?
    self.gst_no = gst_no.strip.upcase if gst_no.present?
    self.gst_no = nil unless gst_registered?
    OPTIONAL_IDENTIFIERS.each { |attribute| self[attribute] = nil if self[attribute].blank? }
  end
end
