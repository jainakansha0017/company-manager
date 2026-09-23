module Api
  module V1
    class SaudasController < ApplicationController
      protect_from_forgery with: :exception

      before_action :set_sauda, only: %i[show update destroy]

      # Always read through the register: /api/v1/saudas?company_id=1&seller_id=2
      def index
        scope = Sauda.where(company_id: params[:company_id], seller_id: params[:seller_id])
                     .includes(:buyer, sauda_marks: %i[mark sauda_grades])
                     .ordered

        render json: scope.map { |sauda| serialize(sauda) }
      end

      # One sauda on its own, so the edit form works from a pasted link.
      def show
        render json: serialize(@sauda)
      end

      def create
        sauda = Sauda.new(sauda_params)

        if sauda.save
          render json: serialize(sauda), status: :created
        else
          render json: { errors: sauda.errors.messages }, status: :unprocessable_content
        end
      end

      def update
        if @sauda.update(replacing_marks(sauda_params))
          render json: serialize(@sauda)
        else
          render json: { errors: @sauda.errors.messages }, status: :unprocessable_content
        end
      end

      def destroy
        @sauda.destroy
        head :no_content
      end

      private

      def set_sauda
        @sauda = Sauda.includes(:buyer, sauda_marks: %i[mark sauda_grades]).find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { errors: { base: ["Sauda not found"] } }, status: :not_found
      end

      # The form sends its marks whole every time, so the ones on record are
      # dropped and written again rather than matched up row by row. Nothing
      # outside the sauda refers to a sauda_mark, so rewriting them is invisible,
      # and doing it through _destroy keeps it inside the save's transaction —
      # a sauda that fails validation still has the marks it started with.
      def replacing_marks(attributes)
        return attributes unless attributes.key?(:sauda_marks_attributes)

        dropped = @sauda.sauda_mark_ids.map { |id| { id: id, _destroy: true } }
        attributes.merge(sauda_marks_attributes: dropped + attributes[:sauda_marks_attributes])
      end

      def sauda_params
        # amount and the four figures worked out from it are deliberately absent:
        # the model prices the grades at their rates and takes the bill from
        # there, so accepting them would only invite a bill that disagrees with
        # the kilos underneath it. discount_percent is the one figure entered.
        params.require(:sauda).permit(
          :company_id, :seller_id, :buyer_id, :sauda_no, :sauda_date, :bill_date,
          :tax_invoice_no, :destination, :discount_percent,
          :transporter_name, :bilty_no, :bilty_date,
          sauda_marks_attributes: [
            :id, :mark_id, :lot_nos, :_destroy,
            { sauda_grades_attributes: %i[id grade bags weight rate _destroy] }
          ]
        )
      end

      def serialize(sauda)
        sauda.as_json(
          only: %i[id company_id seller_id buyer_id sauda_no sauda_date bill_date
                   tax_invoice_no destination transporter_name bilty_no bilty_date
                   amount discount_percent total_tax_bill_amt gst_amt disc_amt
                   taxable_value brokerage_amt total_kg created_at]
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
          "total_bags" => sauda_mark.total_bags,
          "total_kg" => sauda_mark.total_kg,
          "amount" => sauda_mark.amount,
          "sauda_grades" => sauda_mark.sauda_grades.map do |grade|
            grade.as_json(only: %i[id grade bags weight rate])
                 .merge("total_kg" => grade.total_kg, "amount" => grade.amount)
          end
        }
      end
    end
  end
end
