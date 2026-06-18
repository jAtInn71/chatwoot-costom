module Enterprise
  module Api
    module V1
      class StubsController < Api::BaseController
        # /enterprise/api/v1/accounts/:id/limits
        # Frontend calls this on every dashboard load to check plan limits.
        # We return an empty limits object so community build never crashes.
        def limits
          render json: { id: params[:id].to_i, limits: {} }, status: :ok
        end

        # Generic no-op for other enterprise POST endpoints.
        def noop
          render json: {}, status: :ok
        end
      end
    end
  end
end
