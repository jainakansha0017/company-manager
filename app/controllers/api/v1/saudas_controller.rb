module Api
  module V1
    class SaudasController < ApplicationController
      protect_from_forgery with: :exception

      before_action :set_sauda, only: %i[show update destroy]

      # Always read through the register: /api/v1/saudas?seller_id=2
      # The same register downloads as a file at .xlsx and .pdf.
      #
      # The JSON is the seller's whole register: every sauda carries the
      # financial year it falls in, and the screen narrows to one year from
      # there without going back to the server. A download is a fresh request
      # with nothing loaded, so `financial_year` narrows it here instead.
      def index
        scope = Sauda.where(seller_id: params[:seller_id])
                     .includes(:buyer, sauda_marks: %i[mark sauda_grades])
                     .ordered

        respond_to do |format|
          format.json { render json: scope.map { |sauda| serialize(sauda) } }
          format.xlsx { send_register(scope, :xlsx) }
          format.pdf { send_register(scope, :pdf) }
        end
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

      # A download is a plain GET carrying the session cookie, so it is behind
      # the same login as the JSON and needs no CSRF token of its own.
      # `company_id` is optional and only there for old links/exports made
      # before a sauda stopped needing one — the register itself is read by
      # seller alone now.
      def send_register(scope, extension)
        financial_year = params[:financial_year]
        export = SaudaRegisterExport.new(
          scope.in_financial_year(financial_year).to_a,
          company: params[:company_id].presence && Company.find(params[:company_id]),
          seller: Seller.find(params[:seller_id]),
          financial_year: financial_year.presence,
        )

        send_data extension == :xlsx ? export.to_xlsx : export.to_pdf,
                  filename: export.filename(extension),
                  type: Mime[extension].to_s
      rescue ActiveRecord::RecordNotFound
        head :not_found
      end

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
          # Worked out here rather than in the browser, so the rule for where
          # April falls lives in one place.
          "financial_year" => sauda.financial_year,
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
