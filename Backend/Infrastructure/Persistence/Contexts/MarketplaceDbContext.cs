using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Domain.Entities;
using Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;

namespace Infrastructure.Persistence.Contexts
{
    public class MarketplaceDbContext : IdentityDbContext<ApplicationUser, ApplicationRole, Guid, IdentityUserClaim<Guid>, IdentityUserRole<Guid>, IdentityUserLogin<Guid>, IdentityRoleClaim<Guid>, IdentityUserToken<Guid>>
    {
        public MarketplaceDbContext(DbContextOptions<MarketplaceDbContext> options) : base(options) { }

        public DbSet<Listing> Listings { get; set; }
        public DbSet<Category> Categories { get; set; }
        public DbSet<ListingProperty> ListingProperties { get; set; }
        public DbSet<ListingPropertyValue> ListingPropertyValues { get; set; }
        public DbSet<StateOfItem> StateOfItem { get; set; }
		public DbSet<Image> Images { get; set; }
        public DbSet<CartItem> CartItems { get; set; }
        public DbSet<FavoriteItem> FavoriteItems { get; set; }
        public DbSet<Conversation> Conversations { get; set; }
		public DbSet<Message> Messages { get; set; }
		public DbSet<ConversationParticipant> ConversationParticipant { get; set; }
        public DbSet<Order> Orders { get; set; }
		public DbSet<City> Cities { get; set; }
        public DbSet<Review> Reviews { get; set; }
        public DbSet<SellerSubscription> SellerSubscriptions { get; set; }
        public DbSet<ListingView> ListingViews { get; set; }
        public DbSet<ListingGuestView> ListingGuestViews { get; set; }
		protected override void OnModelCreating(ModelBuilder modelBuilder) {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<ApplicationUser>(builder =>
            {
                builder.Property(u => u.NormalizedNickname)
                    .HasMaxLength(50)
                    .IsRequired(false);
                builder.Property(u => u.PendingEmail)
                    .HasMaxLength(254)
                    .IsRequired(false);
                builder.Property(u => u.NotifyEmailOnNewMessage)
                    .HasDefaultValue(true);
                builder.Property(u => u.NotifyEmailOnSellerOrder)
                    .HasDefaultValue(true);
                builder.Property(u => u.NotifyEmailOnFollowedSellerListing)
                    .HasDefaultValue(true);
                builder.Property(u => u.NotifyEmailOnLogin)
                    .HasDefaultValue(true);
                builder.Property(u => u.MustChangePassword)
                    .HasDefaultValue(false);
                builder.HasIndex(u => u.NormalizedNickname)
                    .IsUnique();
            });

            modelBuilder.Entity<Listing>(builder =>
            {
                builder.Property(listing => listing.Title)
                    .HasMaxLength(120)
                    .IsRequired();
                builder.Property(listing => listing.Description)
                    .HasMaxLength(2000)
                    .IsRequired(false);
                builder.ToTable(table =>
                    table.HasCheckConstraint(
                        "CK_Listings_Title_MinLength",
                        "char_length(`Title`) >= 3"));
            });

            modelBuilder.Entity<Listing>()
				.HasOne<ApplicationUser>()  // Define the ApplicationUser relationship
				.WithMany(u => u.Listings)
				.HasForeignKey("SellerId");

            modelBuilder.Entity<ConversationParticipant>()
                .HasKey(cp => new { cp.ConversationId, cp.UserId });

            modelBuilder.Entity<ConversationParticipant>()
                .HasOne(cp => cp.Conversation)
                .WithMany(c => c.ConversationParticipants)
                .HasForeignKey(cp => cp.ConversationId);

            modelBuilder.Entity<ConversationParticipant>()
                .HasOne<ApplicationUser>()
                .WithMany(u => u.ConversationParticipants)
                .HasForeignKey(cp => cp.UserId);
            modelBuilder.Entity<CartItem>()
                .HasKey(ci => new { ci.UserId, ci.ListingId });
            modelBuilder.Entity<CartItem>()
                .HasOne(ci => ci.Listing)
                .WithMany()
                .HasForeignKey(ci => ci.ListingId);
            modelBuilder.Entity<CartItem>()
                .HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(ci => ci.UserId);
            modelBuilder.Entity<FavoriteItem>()
                .HasKey(fi => new { fi.UserId, fi.ListingId });
            modelBuilder.Entity<FavoriteItem>()
                .HasOne(fi => fi.Listing)
                .WithMany()
                .HasForeignKey(fi => fi.ListingId);
            modelBuilder.Entity<FavoriteItem>()
                .HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(fi => fi.UserId);
            modelBuilder.Entity<Message>()
                .HasOne<ApplicationUser>()
                .WithMany(u => u.Messages)
                .HasForeignKey(m => m.SenderId);
            modelBuilder.Entity<Order>()
                .HasOne(o => o.Listing)
                .WithMany()
                .HasForeignKey(o => o.ListingId);
            modelBuilder.Entity<Order>()
                .HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(o => o.BuyerId);
            modelBuilder.Entity<Order>()
                .HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(o => o.SellerId);
            modelBuilder.Entity<City>(builder =>
            {
                builder.Property(city => city.Location)
				.HasColumnType("POINT SRID 4326")
                .IsRequired();
            });
			modelBuilder.Entity<Review>(builder =>
			{
                builder.HasKey(r => r.Id);
                builder.Property(r => r.ReviewText)
					.IsRequired();
				builder.HasOne<ApplicationUser>()
				 .WithMany(u => u.ReviewsGiven)
				 .HasForeignKey(r => r.ReviewerId);
				builder.HasOne<ApplicationUser>()
				 .WithMany(u => u.ReviewsReceived)
				 .HasForeignKey(r => r.RevieweeId);
			});
            modelBuilder.Entity<SellerSubscription>(builder =>
            {
                builder.HasKey(subscription => new
                {
                    subscription.SubscriberId,
                    subscription.SellerId
                });
                builder.HasOne<ApplicationUser>()
                    .WithMany()
                    .HasForeignKey(subscription => subscription.SubscriberId)
                    .OnDelete(DeleteBehavior.Cascade);
                builder.HasOne<ApplicationUser>()
                    .WithMany()
                    .HasForeignKey(subscription => subscription.SellerId)
                    .OnDelete(DeleteBehavior.Cascade);
            });
            modelBuilder.Entity<ListingView>(builder =>
            {
                builder.HasKey(listingView => new
                {
                    listingView.ListingId,
                    listingView.ViewerId
                });
                builder.HasOne(listingView => listingView.Listing)
                    .WithMany()
                    .HasForeignKey(listingView => listingView.ListingId)
                    .OnDelete(DeleteBehavior.Cascade);
                builder.HasOne<ApplicationUser>()
                    .WithMany()
                    .HasForeignKey(listingView => listingView.ViewerId)
                    .OnDelete(DeleteBehavior.Cascade);
                builder.Property(listingView => listingView.ViewedAt)
                    .IsRequired();
            });
            modelBuilder.Entity<ListingGuestView>(builder =>
            {
                builder.HasKey(listingGuestView => new
                {
                    listingGuestView.ListingId,
                    listingGuestView.ViewerFingerprint
                });
                builder.HasOne(listingGuestView => listingGuestView.Listing)
                    .WithMany()
                    .HasForeignKey(listingGuestView => listingGuestView.ListingId)
                    .OnDelete(DeleteBehavior.Cascade);
                builder.Property(listingGuestView => listingGuestView.ViewerFingerprint)
                    .HasMaxLength(64)
                    .IsRequired();
                builder.Property(listingGuestView => listingGuestView.ViewedAt)
                    .IsRequired();
            });

            var adminRoleId = "e8c9ac14-c7f6-4991-88aa-ad40bfe8f707";
			var userRoleId = "2d39b4e7-843e-410b-b6e4-ae30e38039f4";
			var devRoleId = "996f9a95-c46c-40fa-9bb6-144a05138cdc";
			var roles = new List<ApplicationRole> {
				new ApplicationRole {
					Id = new Guid(adminRoleId),
					ConcurrencyStamp = adminRoleId,
					Name = "Admin",
					NormalizedName = "Admin".ToUpper()
				},
				new ApplicationRole {
					Id = new Guid(userRoleId),
					ConcurrencyStamp = userRoleId,
					Name = "User",
					NormalizedName = "User".ToUpper()
				},
				new ApplicationRole {
					Id = new Guid(devRoleId),
					ConcurrencyStamp = devRoleId,
					Name = "Developer",
					NormalizedName = "Developer".ToUpper()
				}
			};
			modelBuilder.Entity<ApplicationRole>().HasData(roles);

		}
	}
}
