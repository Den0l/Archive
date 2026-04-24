using Domain.Entities;
using Microsoft.AspNetCore.Identity;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Infrastructure.Identity {
    /// <summary>
    /// Setup, so that users use Guid as a key instead of a string
    /// </summary>
    public class ApplicationUser : IdentityUser<Guid> {
        public string Nickname { get; set; }
        [MaxLength(50)]
        public string NormalizedNickname { get; set; }
        public DateTime LastLoggedIn { get; set; }
        [MaxLength(254)]
        public string? PendingEmail { get; set; }
        public DateTime? PendingEmailRequestedAt { get; set; }
        public bool NotifyEmailOnNewMessage { get; set; } = true;
        public bool NotifyEmailOnSellerOrder { get; set; } = true;
        public bool NotifyEmailOnFollowedSellerListing { get; set; } = true;
        public bool NotifyEmailOnLogin { get; set; } = true;
        public bool MustChangePassword { get; set; }
        /// <summary>
        /// One to many relation with listings
        /// </summary>
		public List<Listing> Listings { get; set; }
        public List<ConversationParticipant> ConversationParticipants { get; set; }
        public List<Message> Messages { get; set; }
        public List<Review> ReviewsGiven { get; set; }
        public List<Review> ReviewsReceived { get; set; }


    }
}
