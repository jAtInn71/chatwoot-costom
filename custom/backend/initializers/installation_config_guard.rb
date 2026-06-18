# On a fresh database the installation_configs table does not exist yet when
# Rails initializers run (before db:chatwoot_prepare creates it).
# This patch makes InstallationConfig silently return nil instead of raising
# PG::UndefinedTable, so the "Failed to configure AI Agents SDK" error
# (and any similar boot-time reads) do not abort startup or migration.

Rails.application.config.to_prepare do
  InstallationConfig.singleton_class.prepend(Module.new do
    def find_by(...)
      super
    rescue ActiveRecord::StatementInvalid, PG::UndefinedTable
      nil
    end

    def [](...)
      super
    rescue ActiveRecord::StatementInvalid, PG::UndefinedTable
      nil
    end
  end)
rescue NameError
  # InstallationConfig not loaded yet — nothing to patch
end
