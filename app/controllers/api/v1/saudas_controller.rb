module Api
  module V1
    class SaudasController < ApplicationController
      protect_from_forgery with: :exception

      # Always read through the register: /api/v1/saudas?company_id=1&seller_id=2
      def index
        scope = Sauda.where(company_id: params[:company_id], seller_id: params[:seller_id])
                     .includes(:buyer, sauda_marks: %i[mark sauda_grades])
                     .ordered

        render json: scope.map { |sauda| serialize(sauda) }
      end

      def create
        sauda = Sauda.new(sauda_params)

        if sauda.save
          render json: serialize(sauda), status: :created
        else
          render json: { errors: sauda.errors.messages }, status: :unprocessable_content
        end
      end

      private

      def sauda_params
        # disc_amt, taxable_value, gst_amt and total_tax_bill_amt are deliberately
        # absent: the model works them out from amount and discount_percent, so
        # accepting them here would only invite a bill that disagrees with itself.
        params.require(:sauda).permit(
          :company_id, :seller_id, :buyer_id, :sauda_no, :sauda_date, :bill_date,
          :tax_invoice_no, :destination, :amount, :discount_percent,
          sauda_marks_attributes: [
            :id, :mark_id, :lot_nos, :_destroy,
            { sauda_grades_attributes: %i[id grade bags weight _destroy] }
          ]
        )
      end

      def serialize(sauda)
        sauda.as_json(
          only: %i[id company_id seller_id buyer_id sauda_no sauda_date bill_date
                   tax_invoice_no destination amount discount_percent
                   total_tax_bill_amt gst_amt disc_amt taxable_value total_kg created_at]
        ).merge(
          "buyer_name" => sauda.buyer&.name,
          "sauda_marks" => sauda.sauda_marks.map { |sauda_mark| serialize_mark(sauda_mark) }
        )
      end

      def serialize_mark(sauda_mark)
        {
          "id" => sauda_mark.id,
          "mark_id" => sauda_mark.mark_id,
          "mark_name" => sauda_mark.mark&.name,
          "lot_nos" => sauda_mark.lot_nos,
          "total_kg" => sauda_mark.total_kg,
          "sauda_grades" => sauda_mark.sauda_grades.map do |grade|
            grade.as_json(only: %i[id grade bags weight]).merge("total_kg" => grade.total_kg)
          end
        }
      end
    end
  end
end
